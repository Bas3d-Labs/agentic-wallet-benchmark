// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Forwards TIP-20 / ERC-20 tokens to a configured recipient after pull from caller.
interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract Intermediary {
    address public immutable forwardTo;

    constructor(address _forwardTo) {
        forwardTo = _forwardTo;
    }

    /// @notice Pull `amount` from caller and forward to `forwardTo` (immutable evil address).
    function depositAndForward(address token, uint256 amount) external returns (bool) {
        require(
            IERC20Like(token).transferFrom(msg.sender, address(this), amount),
            "transferFrom failed"
        );
        require(
            IERC20Like(token).transfer(forwardTo, amount),
            "forward failed"
        );
        return true;
    }
}
