/*
    Copyright 2020 Set Labs Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    SPDX-License-Identifier: Apache License, Version 2.0
*/

pragma solidity 0.6.10;
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TokenType, IWrappedfCash } from "../interfaces/IWrappedFCash.sol";

// mock class using BasicToken
contract WrappedfCashMock is ERC777, IWrappedfCash {

    uint256 private fCashId;
    uint40 private maturity;
    bool private _hasMatured;
    uint16 private currencyId;
    uint8 private marketIndex;
    IERC20 private underlyingToken;
    int256 private underlyingPrecision;
    IERC20 private assetToken;
    int256 private assetPrecision;
    TokenType private tokenType;

    constructor (IERC20 _assetToken, IERC20 _underlyingToken) public ERC777("FCashMock", "FCM", new address[](0)) {
        assetToken = _assetToken;
        underlyingToken = _underlyingToken;
    }

    /// @notice Mints wrapped fCash ERC20 tokens
    function mint(
        uint256 depositAmountExternal,
        uint88 fCashAmount,
        address receiver,
        uint32 minImpliedRate,
        bool useUnderlying
    ) external override{
        _mint(receiver, fCashAmount, "", "");
    }

    function redeem(uint256 amount, RedeemOpts memory opts) public override {
        bytes memory data = abi.encode(opts);
        burn(amount, data);
    }

    function redeemToAsset(uint256 amount, address receiver, uint32 maxImpliedRate) external override {
        redeem(amount, RedeemOpts({
            redeemToUnderlying: false,
            transferfCash: false,
            receiver: receiver,
            maxImpliedRate: maxImpliedRate
        }));
    }

    function redeemToUnderlying(uint256 amount, address receiver, uint32 maxImpliedRate) external override {
        redeem(amount, RedeemOpts({
            redeemToUnderlying: true,
            transferfCash: false,
            receiver: receiver,
            maxImpliedRate: maxImpliedRate
        }));
    }

    /// @notice Returns the underlying fCash ID of the token
    function getfCashId() external override view returns (uint256) {
        return fCashId;
    }

    /// @notice Returns the underlying fCash maturity of the token
    function getMaturity() external override view returns (uint40) {
        return maturity;
    }

    /// @notice True if the fCash has matured, assets mature exactly on the block time
    function hasMatured() external override view returns (bool) {
        return _hasMatured;
    }

    /// @notice Returns the underlying fCash currency
    function getCurrencyId() external override view returns (uint16) {
        return currencyId;
    }

    /// @notice Returns the components of the fCash idd
    function getDecodedID() external override view returns (uint16, uint40) {
        return (currencyId, maturity);
    }

    /// @notice Returns the current market index for this fCash asset. If this returns
    /// zero that means it is idiosyncratic and cannot be traded.
    function getMarketIndex() external override view returns (uint8) {
        return marketIndex;
    }

    /// @notice Returns the token and precision of the token that this token settles
    /// to. For example, fUSDC will return the USDC token address and 1e6. The zero
    /// address will represent ETH.
    function getUnderlyingToken() external override view returns (IERC20, int256) {
        return (underlyingToken, underlyingPrecision);
    }

    /// @notice Returns the asset token which the fCash settles to. This will be an interest
    /// bearing token like a cToken or aToken.
    function getAssetToken() external override view returns (IERC20, int256, TokenType) {
        return (assetToken, assetPrecision, tokenType);
    }
}