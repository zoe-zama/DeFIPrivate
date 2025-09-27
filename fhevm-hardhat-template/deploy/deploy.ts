import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedSealedBidAuction = await deploy("SealedBidAuction", {
    from: deployer,
    log: true,
  });
  

  console.log(`SealedBidAuction contract: `, deployedSealedBidAuction.address);
 
};
export default func;
func.id = "deploy"; // id required to prevent reexecution
func.tags = ["SealedBidAuction"];
