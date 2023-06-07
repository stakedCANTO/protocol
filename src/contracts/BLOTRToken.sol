//SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ITurnstile} from "./interfaces/ITurnstile.sol";

/// @title Staked Canto Governance Token
///
/// @dev This is the contract for the Liquid Staked Canto governance token
/// The role admin must give a minting contract permisions required to mint
/// tokens.
contract BLOTRToken is AccessControlUpgradeable, ERC20Upgradeable {
    /// @dev The identifier of the role which maintains other roles.
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");

    /// @dev The identifier of the role which allows accounts to mint tokens.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER");

    /// @dev The identifier of the role which allows accounts to burn tokens.
    bytes32 public constant BURNER_ROLE = keccak256("BURNER");

    ITurnstile turnstile;

    constructor() {}

    /// @dev A modifier which checks that the caller has the minter role.
    modifier onlyMinter() {
        require(hasRole(MINTER_ROLE, msg.sender), "BLOTR: only minter");
        _;
    }

    /// @dev A modifier which checks that the caller has the burner role.
    modifier onlyBurner() {
        require(hasRole(BURNER_ROLE, msg.sender), "BLOTR: only burner");
        _;
    }

    /// @dev initializer to be called once after deployment
    ///
    /// @param _adminAddress address of contract admin who controls permissions
    function initialize(
        address _adminAddress,
        address _turnstile
    ) external initializer {
        AccessControlUpgradeable.__AccessControl_init();
        ERC20Upgradeable.__ERC20_init("sCANTO BLOTR", "BLOTR");
        _setupRole(ADMIN_ROLE, _adminAddress);
        _setRoleAdmin(MINTER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(BURNER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        turnstile = ITurnstile(_turnstile); // Canto CSR
        turnstile.assign(675);
    }

    /// @dev Mints tokens to a recipient.
    ///
    /// This function reverts if the caller does not have the minter role.
    ///
    /// @param _recipient the account to mint tokens to.
    /// @param _amount    the amount of tokens to mint.
    function mint(address _recipient, uint256 _amount) external onlyMinter {
        _mint(_recipient, _amount);
    }

    /// @dev Burns tokens from an address .
    ///
    /// This function reverts if the caller does not have the burner role.
    ///
    /// @param _from      the account to burn tokens from.
    /// @param _amount    the amount of tokens to burn.
    function burn(address _from, uint256 _amount) external onlyBurner {
        _burn(_from, _amount);
    }
}
