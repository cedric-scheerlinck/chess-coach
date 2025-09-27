from typing import Annotated

from llama_index.core.workflow import Context
from llama_index.llms.openai import OpenAI
from llama_index.protocols.ag_ui.events import StateSnapshotWorkflowEvent
from llama_index.protocols.ag_ui.router import get_ag_ui_workflow_router


# This tool has a client-side version that is actually called to change the background
# These tools just need a response string to make it look like they are executing
def change_theme_color(
    theme_color: Annotated[str, "The hex color value. i.e. '#123456''"],
) -> str:
    """Change the background color of the chat. Can be any hex color value."""
    return f"Changing background to {theme_color}"

# This is another client-side tool that is actually called to add a proverb to the list
# These tools just need a response string to make it look like they are executing
async def add_proverb(
    proverb: Annotated[str, "The proverb to add. Make it witty, short and concise."],
) -> str:
    """Add a proverb to the list of proverbs."""
    return f"Added proverb: {proverb}"

# Chess position tool - allows the AI to set specific FEN positions
def set_chess_position(
    fen_position: Annotated[str, "The FEN position string to set on the chess board. Must be a valid FEN notation."],
) -> str:
    """Set the chess board to a specific FEN position. Use this to show specific positions, openings, or tactical puzzles."""
    return f"Setting chess position to: {fen_position}"

# This is a backend tool that executes code on the backend server
# For now this is a dummy implementation, but it could very well call a weather API
async def get_weather(
    location: Annotated[str, "The location to get the weather for."],
) -> str:
    """Get the weather for a given location."""
    return f"The weather in {location} is sunny and 70 degrees."


agentic_chat_router = get_ag_ui_workflow_router(
    llm=OpenAI(model="gpt-4.1"),
    # Tools that are executed in the frontend client
    frontend_tools=[set_chess_position],
    # Tools that are executed in the backend server
    backend_tools=[],
    system_prompt="You are a helpful chess assistant that can analyze chess positions, suggest moves, and help with chess strategy. You can understand FEN notation and provide chess advice. You can set specific positions on the board using the set_chess_position tool to demonstrate openings, tactics, or specific game situations.",
    initial_state={
        "position": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    },
)
