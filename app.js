// server.js

const express = require('express');
const ethers = require('ethers');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: '*',
}));
app.use(express.json());

const contractPath = path.join(__dirname, '/contracts/Contract.sol');
const contractDir = path.dirname(contractPath);
const artifactsDir = path.join(__dirname, '/artifacts');
const configPath = path.join(__dirname, 'hardhat.config.js');

// Ensure directories exist
if (!fs.existsSync(contractDir)) {
  fs.mkdirSync(contractDir, { recursive: true });
}
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

// Ensure hardhat.config.js exists
if (!fs.existsSync(configPath)) {
  const configContent = `require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.6",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
  }
};`;

  fs.writeFileSync(configPath, configContent);
}

// Endpoint to compile solidity code
app.post('/compile', async (req, res) => {
    const input = req.body.code;
    const name = req.body.name;
    console.log(`Compiling ${name}... `, { input });
    // Write the Solidity code to a .sol file
    fs.writeFileSync(path.join(contractDir, `${name}.sol`), input);

    exec('npx hardhat compile', (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        res.status(500).send({ error: error.message });
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        res.status(500).send({ error: stderr });
        return;
      }
      const artifactPath = path.join(artifactsDir, `contracts/${name}.sol/${name}.json`);
      if (fs.existsSync(artifactPath)) {
        const compiled = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        res.send(compiled);
      } else {
        res.status(500).send({ error: "Compilation failed or took too long" });
      }
    });
  });

// Endpoint to deploy compiled code
app.post('/deploy', async (req, res) => {
    const { abi, bytecode } = req.body;
    console.log(`Deploying... `, { abi, bytecode });
    // Hardhat's ContractFactory can calculate the transaction data
    let factory = new ethers.ContractFactory(abi, bytecode);
    const transactionData = factory.getDeployTransaction().data;

    res.send({ transactionData });
});

app.post('/delete', async (req, res) => {
  const name = req.body.name;
  console.log(`Deleting ${name}... `);
  const artifactPath = path.join(artifactsDir, `contracts/${name}.sol/${name}.json`);
  if (fs.existsSync(artifactPath)) {
    fs.unlinkSync(artifactPath);
  }
  const contractPath = path.join(contractDir, `${name}.sol`);
  if (fs.existsSync(contractPath)) {
    fs.unlinkSync(contractPath);
  }
  res.send({ success: true });
});


// Start server
app.listen(process.env.PORT || 80)