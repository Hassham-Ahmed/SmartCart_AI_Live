import uvicorn
from mcp.server import MCPServer
from smartcart_mcp.tools.product_tools import (
    search_products,
    add_to_cart,
    add_to_wishlist,
    get_cart,
    get_wishlist,
    place_order,
    get_orders
)

# Initialize MCP Server
mcp = MCPServer("SmartCart AI")


# 1. Search Products Tool
@mcp.tool()
def find_products(
    search: str = "",
    category: str = "",
    min_price: float = 0,
    max_price: float = 0,
    limit: int = 5
) -> list:
    """
    Search products from the SmartCart AI MySQL database.
    """
    return search_products(
        search=search or None,
        category=category or None,
        min_price=min_price if min_price > 0 else None,
        max_price=max_price if max_price > 0 else None,
        limit=limit
    )
    
# 2. Add to Cart Tool
@mcp.tool()
def add_product_to_cart(
    user_id: int,
    product_id: int,
    quantity: int = 1
) -> dict:
    """
    Add a product to the user's shopping cart.
    """
    return add_to_cart(
        user_id=user_id,
        product_id=product_id,
        quantity=quantity
    )


# 3. Add to Wishlist Tool
@mcp.tool()
def add_product_to_wishlist(
    user_id: int,
    product_id: int
) -> dict:
    """
    Add a product to the user's wishlist.
    """
    return add_to_wishlist(
        user_id=user_id,
        product_id=product_id
    )


# 4. Get Cart Tool
@mcp.tool()
def get_user_cart(user_id: int) -> dict:
    """
    Get the current shopping cart of a user.
    """
    return get_cart(user_id=user_id)


# 5. Get Wishlist Tool
@mcp.tool()
def get_user_wishlist(user_id: int) -> dict:
    """
    Get the current wishlist of a user.
    """
    return get_wishlist(user_id=user_id)


# 6. Place Order Tool
@mcp.tool()
def place_user_order(
    user_id: int,
    shipping_address: str,
    payment_method: str
) -> dict:
    """
    Place an order using the user's current shopping cart.
    """
    return place_order(
        user_id=user_id,
        shipping_address=shipping_address,
        payment_method=payment_method
    )


# 7. Get Orders Tool
@mcp.tool()
def get_user_orders(user_id: int) -> dict:
    """
    Get the order history of a user.
    """
    return get_orders(user_id=user_id)


# Single Entry Point for HTTP / Uvicorn Server
if __name__ == "__main__":
    mcp.run(
        transport="streamable-http",
        host="127.0.0.1",
        port=8000
    )