🧾 DeFiContract – Confidential Credit-Based Lending

Description:
This smart contract enables a privacy-preserving lending system using Fully Homomorphic Encryption (FHE) on the Sepolia network. It allows users to submit encrypted salary and credit score data to receive loan offers without revealing their private information.

Key Functions:

Encrypted Credit Profiles: Users provide salary and credit score as encrypted values.

Loan Packages: Lenders can define fixed loan options with duration and interest rate.

Confidential Borrowing: Loan amounts and repayments are processed in encrypted form.

Decryption Requests: Controlled partial decryption for validation (handled via FHE).

Persisted Package Choice: Borrowers’ selected loan package remains even after repayment.

How to Run:

Deploy the contract on Sepolia with FHEVM configuration.

Users encrypt their credit data using the FHE SDK and submit it.

The lender verifies encrypted data and grants loans securely.

Borrowers repay with encrypted amounts; contract updates total repay privately.
