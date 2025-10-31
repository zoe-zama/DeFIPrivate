// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, externalEuint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Confidential Credit-Based Lending (Fixed FHE.div + Fixed euint64 delete + chosenPackage persist)
contract DeFiContract is SepoliaConfig {
    address public lender;
    uint256 public actualPool;
    euint64 public pool;

    struct CreditProfile {
        euint64 salary;
        euint64 creditScore;
        bool submitted;
    }

    struct LoanPackage {
        uint64 durationDays;
        uint64 ratePercent;
    }

    LoanPackage[3] public packages;
    mapping(address => CreditProfile) public creditProfiles;
    mapping(address => uint8) public chosenPackage; // 1,2,3 → persists after repay
    mapping(address => euint64) public borrowAmounts;
    mapping(address => euint64) public totalRepays;
    mapping(address => uint64) public decryptedTotalRepay;
    mapping(address => bool) public agreed;
    mapping(address => uint64) public loans;

    // Decryption tracking
    mapping(uint256 => address) private requestToBorrower;
    uint256 private decryptionRequestIdPool;
    uint256 private decryptionRequestIdDeposit;
    uint256 private decryptionRequestIdRepay;
    mapping(uint256 => uint256) private expectedDepositAmounts;

    // Events
    event Deposit(address indexed lender, uint256 requestId);
    event CreditSubmitted(address indexed borrower);
    event PackageChosen(address indexed borrower, uint8 packageId);
    event BorrowRequested(address indexed borrower, uint256 requestId);
    event BorrowConfirmed(address indexed borrower, uint64 amount, uint64 totalRepay, uint64 durationDays);
    event RepayRequested(address indexed borrower, uint256 requestId);
    event Repaid(address indexed borrower, uint64 amount);
    event WithdrawalRequested(address indexed lender, uint256 requestId);
    event PoolWithdrawn(address indexed lender, uint64 amount);

    modifier onlyLender() {
        require(msg.sender == lender, "Only lender");
        _;
    }

    constructor() {
        lender = msg.sender;
        pool = FHE.asEuint64(0);
        actualPool = 0;
        FHE.allowThis(pool);

        packages[0] = LoanPackage(30,  6);   // 1 month → 6% APR
        packages[1] = LoanPackage(182, 8);   // ~6 months → 8% APR
        packages[2] = LoanPackage(365, 10);  // 12 months → 10% APR
    }

    // DEPOSIT
    function deposit(
        externalEuint64 encryptedAmount,
        bytes calldata amountProof
    ) external payable onlyLender {
        require(msg.value > 0, "Deposit > 0");
        require(msg.value <= type(uint64).max, "Too large");

        actualPool += msg.value;
        pool = FHE.add(pool, FHE.fromExternal(encryptedAmount, amountProof));
        FHE.allowThis(pool);

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(FHE.fromExternal(encryptedAmount, amountProof));
        uint256 requestId = FHE.requestDecryption(cts, this.callbackVerifyDeposit.selector);
        expectedDepositAmounts[requestId] = msg.value;
        decryptionRequestIdDeposit = requestId;

        emit Deposit(lender, requestId);
    }

    function callbackVerifyDeposit(uint256 requestId, bytes memory cleartexts, bytes memory proof) external {
        FHE.checkSignatures(requestId, cleartexts, proof);
        uint64 decrypted = abi.decode(cleartexts, (uint64));
        require(uint256(decrypted) == expectedDepositAmounts[requestId], "Mismatch");
        delete expectedDepositAmounts[requestId];
    }

    // SUBMIT CREDIT PROFILE
    function submitCreditProfile(
        externalEuint64 encryptedSalary,
        externalEuint64 encryptedCreditScore,
        bytes calldata salaryProof,
        bytes calldata scoreProof
    ) external {
        require(!creditProfiles[msg.sender].submitted, "Already submitted");

        euint64 salary = FHE.fromExternal(encryptedSalary, salaryProof);
        euint64 score = FHE.fromExternal(encryptedCreditScore, scoreProof);

        creditProfiles[msg.sender] = CreditProfile({
            salary: salary,
            creditScore: score,
            submitted: true
        });

        FHE.allowThis(salary);
        FHE.allowThis(score);

        emit CreditSubmitted(msg.sender);
    }

    // CHOOSE PACKAGE
    function choosePackage(uint8 packageId) external {
        require(packageId >= 1 && packageId <= 3, "Invalid package ID");
        require(creditProfiles[msg.sender].submitted, "Submit credit profile first");
        require(chosenPackage[msg.sender] == 0, "Package already chosen");

        chosenPackage[msg.sender] = packageId;
        emit PackageChosen(msg.sender, packageId);
    }

    // REQUEST BORROW
    function requestBorrow(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external {
        require(FHE.isInitialized(pool), "No funds in pool");
        require(!agreed[msg.sender], "Active loan exists");
        require(chosenPackage[msg.sender] >= 1 && chosenPackage[msg.sender] <= 3, "Choose package first");

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        uint8 pkgId = chosenPackage[msg.sender];
        uint64 durationDays = packages[pkgId - 1].durationDays;
        uint64 annualRate = packages[pkgId - 1].ratePercent;

        uint64 denominator = 365 * 100;
        euint64 rateE = FHE.asEuint64(annualRate);
        euint64 daysE = FHE.asEuint64(durationDays);

        euint64 numerator = FHE.mul(FHE.mul(amount, rateE), daysE);
        euint64 interest = FHE.div(numerator, denominator);
        euint64 total = FHE.add(amount, interest);

        borrowAmounts[msg.sender] = amount;
        totalRepays[msg.sender] = total;

        FHE.allowThis(amount);
        FHE.allowThis(total);

        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(amount);
        cts[1] = FHE.toBytes32(total);
        uint256 requestId = FHE.requestDecryption(cts, this.callbackBorrow.selector);
        requestToBorrower[requestId] = msg.sender;

        emit BorrowRequested(msg.sender, requestId);
    }

    // CALLBACK: BORROW
    function callbackBorrow(uint256 requestId, bytes memory cleartexts, bytes memory proof) external {
        FHE.checkSignatures(requestId, cleartexts, proof);
        address borrower = requestToBorrower[requestId];
        require(borrower != address(0), "Invalid request");

        (uint64 amount, uint64 totalRepay) = abi.decode(cleartexts, (uint64, uint64));

        bytes32[] memory ctsPool = new bytes32[](1);
        ctsPool[0] = FHE.toBytes32(pool);
        uint256 poolReqId = FHE.requestDecryption(ctsPool, this.callbackCheckAndTransfer.selector);

        loans[borrower] = amount;
        decryptedTotalRepay[borrower] = totalRepay;
        requestToBorrower[poolReqId] = borrower;
    }

    function callbackCheckAndTransfer(uint256 requestId, bytes memory cleartexts, bytes memory proof) external {
        FHE.checkSignatures(requestId, cleartexts, proof);
        address borrower = requestToBorrower[requestId];
        require(borrower != address(0), "Invalid borrower");

        uint64 poolAmount = abi.decode(cleartexts, (uint64));
        uint64 amount = loans[borrower];
        require(amount <= poolAmount && amount <= actualPool, "Insufficient pool");

        pool = FHE.sub(pool, FHE.asEuint64(amount));
        actualPool -= amount;
        FHE.allowThis(pool);

        loans[borrower] = decryptedTotalRepay[borrower];
        agreed[borrower] = true;
        payable(borrower).transfer(amount);

        borrowAmounts[borrower] = FHE.asEuint64(0);
        totalRepays[borrower] = FHE.asEuint64(0);
        FHE.allowThis(borrowAmounts[borrower]);
        FHE.allowThis(totalRepays[borrower]);
        decryptedTotalRepay[borrower] = 0;
        delete requestToBorrower[requestId];

        uint64 durationDays = packages[chosenPackage[borrower] - 1].durationDays;
        emit BorrowConfirmed(borrower, amount, loans[borrower], durationDays);
    }

    // REPAY
    function repay(externalEuint64 encryptedRepayAmount, bytes calldata inputProof) external payable {
        require(agreed[msg.sender], "No active loan");
        uint64 total = loans[msg.sender];
        require(msg.value == total, "Incorrect repay amount");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(FHE.fromExternal(encryptedRepayAmount, inputProof));
        decryptionRequestIdRepay = FHE.requestDecryption(cts, this.callbackVerifyRepay.selector);
        requestToBorrower[decryptionRequestIdRepay] = msg.sender;

        borrowAmounts[msg.sender] = FHE.fromExternal(encryptedRepayAmount, inputProof);
        FHE.allowThis(borrowAmounts[msg.sender]);

        emit RepayRequested(msg.sender, decryptionRequestIdRepay);
    }

    function callbackVerifyRepay(uint256 requestId, bytes memory cleartexts, bytes memory proof) external {
        FHE.checkSignatures(requestId, cleartexts, proof);
        require(requestId == decryptionRequestIdRepay, "Invalid request ID");
        address borrower = requestToBorrower[requestId];
        uint64 decrypted = abi.decode(cleartexts, (uint64));
        uint64 total = loans[borrower];
        require(decrypted == total, "Repay amount mismatch");

        // Return to pool
        pool = FHE.add(pool, borrowAmounts[borrower]);
        actualPool += total;
        FHE.allowThis(pool);

        // Reset loan state
        delete loans[borrower];
        delete agreed[borrower];
        delete decryptedTotalRepay[borrower];

        // Reset
        borrowAmounts[borrower] = FHE.asEuint64(0);
        totalRepays[borrower] = FHE.asEuint64(0);
        FHE.allowThis(borrowAmounts[borrower]);
        FHE.allowThis(totalRepays[borrower]);

        decryptionRequestIdRepay = 0;
        delete requestToBorrower[requestId];

        emit Repaid(borrower, total);
    }

    // WITHDRAW
    function withdrawPool() external onlyLender {
        require(decryptionRequestIdPool == 0, "Pending withdrawal");
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(pool);
        decryptionRequestIdPool = FHE.requestDecryption(cts, this.callbackWithdrawPool.selector);
        emit WithdrawalRequested(lender, decryptionRequestIdPool);
    }

    function callbackWithdrawPool(uint256 requestId, bytes memory cleartexts, bytes memory proof) external {
        FHE.checkSignatures(requestId, cleartexts, proof);
        require(requestId == decryptionRequestIdPool, "Invalid request");
        uint64 amount = abi.decode(cleartexts, (uint64));
        require(amount <= actualPool, "Insufficient funds");

        pool = FHE.asEuint64(0);
        actualPool = 0;
        FHE.allowThis(pool);
        decryptionRequestIdPool = 0;
        payable(lender).transfer(amount);

        emit PoolWithdrawn(lender, amount);
    }

    // VIEW 
    function getChosenPackage() external view returns (string memory) {
        uint8 id = chosenPackage[msg.sender];
        if (id == 1) return "1 month (6% APR)";
        if (id == 2) return "6 months (8% APR)";
        if (id == 3) return "12 months (10% APR)";
        return "None";
    }
}