//SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {StakedCanto} from "./StakedCanto.sol";
import {ITurnstile} from "./interfaces/ITurnstile.sol";

contract Minter is Ownable {
    StakedCanto public immutable sCANTO;
    address payable public treasury;

    uint256 public initialExchangeRate = 1 ether; // initial cost in CANTO of minting 1 sCANTO
    uint256 public yield; // yield represented in miliBasisPoints (1_000_000 = 10%) per ~year (leap years ignored)
    uint256 public accumulatedYield; // accumulated yield since last update
    uint256 public lastUpdated; // timestamp representing the timestamp that the accumulatedYield was last updated

    uint256 public constant MILI_BASIS_POINTS = 10_000_000; // 1_280_000 = 12.8%
    uint256 public constant YEAR = 60 * 60 * 24 * 365; // second per year (ignore leap years)

    ITurnstile turnstile;

    // events
    event YieldUpdated(
        uint256 oldYield,
        uint256 newYield,
        uint256 exchangeRate
    );
    event TreasuryUpdated(address oldAddress, address newAddress);

    constructor(
        address _stakedCanto,
        address payable _treasury,
        address _turnstile,
        uint256 _initialRate,
        uint256 _initialYield
    ) {
        require(
            _initialRate >= initialExchangeRate,
            "StakedCantoMinter: initial rate below 1 CANTO"
        );
        require(
            _treasury != address(0),
            "StakedCantoMinter: treasury cannot be 0x0"
        );
        sCANTO = StakedCanto(_stakedCanto);
        treasury = _treasury;
        initialExchangeRate = _initialRate;
        yield = _initialYield;
        lastUpdated = block.timestamp;
        turnstile = ITurnstile(_turnstile); // CSR
        turnstile.assign(675);
    }

    /// Sets the desired yield from the owner of this contract
    /// @param _newYield desired yield to be set in MILI_BASIS_POINTS (1_000_000 = 10%)
    function setYield(uint256 _newYield) external onlyOwner {
        uint256 timeElapsed = block.timestamp - lastUpdated;
        // prior to setting the new yield, we need to "accumulate" our past yield
        uint256 additionalYieldAccumulated = (timeElapsed * yield) / YEAR;
        accumulatedYield += additionalYieldAccumulated;
        lastUpdated = block.timestamp;
        emit YieldUpdated(yield, _newYield, getCurrentExchangeRate());
        yield = _newYield;
    }

    /// Sets the desired treaury address that recieves CANTO when
    /// sCANTO is minted
    /// @param _treasury address to forward all CANTO to when minting occurs
    function setTreasury(address payable _treasury) external onlyOwner {
        require(
            _treasury != address(0),
            "StakedCantoMinter: treasury cannot be 0x0"
        );
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    /// Takes in CANTO and mints sCANTO according to the current exchange rate
    /// @param _to address that tokens should be minted to
    /// @param _minAmountToMint min amount of expected sCANTO
    function mint(address _to, uint256 _minAmountToMint) public payable {
        require(msg.value > 0, "StakedCantoMinter: must supply CANTO");
        uint256 exchangeRate = getCurrentExchangeRate();
        uint256 amountToMint = (msg.value * 1 ether) / exchangeRate;
        require(
            amountToMint >= _minAmountToMint,
            "StakedCantoMinter: less than min"
        );
        (bool success, ) = treasury.call{value: msg.value}("");
        require(success, "StakedCantoMinter: send failure to treasury");
        sCANTO.mint(_to, amountToMint); // mint should revert on failure!
    }

    /// returns the current exchange rate based on the block timestamp
    function getCurrentExchangeRate() public view returns (uint256) {
        uint256 timeElapsed = block.timestamp - lastUpdated;
        uint256 yieldBeforeLastUpdate = (initialExchangeRate *
            accumulatedYield) / MILI_BASIS_POINTS;
        uint256 yieldAfterLastUpdate = (timeElapsed *
            yield *
            initialExchangeRate) /
            YEAR /
            MILI_BASIS_POINTS;
        return
            initialExchangeRate + yieldAfterLastUpdate + yieldBeforeLastUpdate;
    }

    /// CANTO sent directly to this contract will mint sCANTO without concern
    /// for the minimum.
    receive() external payable {
        mint(msg.sender, 0);
    }
}
