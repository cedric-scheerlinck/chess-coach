"use client";

import { useState } from "react";
import { ChessBoard } from "@/components/ChessBoard";
import { ShogiBoard } from "@/components/ShogiBoard";

import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotSidebar } from "@copilotkit/react-ui";

export default function CopilotKitPage() {
  const [themeColor, setThemeColor] = useState("#6366f1");
  const [showSidebar, setShowSidebar] = useState(true);

  // 🪁 Frontend Actions: https://docs.copilotkit.ai/guides/frontend-actions
  useCopilotAction({
    name: "change_theme_color",
    parameters: [{
      name: "theme_color",
      description: "The theme color to set. Make sure to pick nice colors.",
      required: true, 
    }],
    handler({ theme_color }) {
      setThemeColor(theme_color);
    },
  });

  return (
    <main style={{ "--copilot-kit-primary-color": themeColor } as CopilotKitCSSProperties}>
      <YourMainContent themeColor={themeColor} />
      {showSidebar && (
        <CopilotSidebar
          clickOutsideToClose={false}
          defaultOpen={true}
          labels={{
            title: "Board Assistant",
            initial: "👋 Hi! I'm your board assistant. Toggle between Chess and Shogi. I can help you analyze positions, suggest moves, and explain concepts. The chessboard will update in real-time as we discuss the game!"
          }}
        />
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => setShowSidebar((v) => !v)}
        style={{ position: "fixed", top: "50%", right: 12, transform: "translateY(-50%)" }}
        className="z-50 px-3 py-2 rounded-md shadow bg-white/90 hover:bg-white text-gray-800 border border-gray-300"
        aria-label={showSidebar ? "Hide chat" : "Show chat"}
      >
        {showSidebar ? "Hide Chat" : "Show Chat"}
      </button>
    </main>
  );
}

// State of the agent, make sure this aligns with your agent's state.
// type AgentState = {
//   proverbs: string[];
// }

type ChessState = {
  position: string;
}

function YourMainContent({ themeColor }: { themeColor: string }) {
  // 🪁 Shared State: https://docs.copilotkit.ai/coagents/shared-state
  const {state, setState} = useCoAgent<ChessState>({
    name: "sample_agent",
    initialState: {
      position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    },
  })

  // Local UI state for toggling between Chess and Shogi
  const [gameType, setGameType] = useState<"chess" | "shogi">("chess");
  const [shogiPosition, setShogiPosition] = useState<string | undefined>(undefined); // undefined -> ShogiBoard uses default

  const handlePositionChange = (newPosition: string) => {
    setState({
      ...state,
      position: newPosition,
    });
  };

  return (
    <div
      style={{ backgroundColor: themeColor }}
      className="h-screen w-screen flex justify-center items-center flex-col transition-colors duration-300"
    >
      <div className="bg-white/20 backdrop-blur-md p-8 rounded-2xl shadow-xl max-w-4xl w-full">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">Chess Coach</h1>
        <p className="text-gray-200 text-center italic mb-6">AI-powered chess coach to level up your chess game 🚀</p>
        <div className="flex justify-center gap-2 mb-4">
          <button
            className={`px-4 py-2 rounded-md text-white ${gameType === "chess" ? "bg-indigo-600" : "bg-indigo-400/60"}`}
            onClick={() => setGameType("chess")}
          >
            Chess
          </button>
          <button
            className={`px-4 py-2 rounded-md text-white ${gameType === "shogi" ? "bg-indigo-600" : "bg-indigo-400/60"}`}
            onClick={() => setGameType("shogi")}
          >
            Shogi
          </button>
        </div>
        <hr className="border-white/20 my-6" />
        {gameType === "chess" ? (
          <ChessBoard 
            position={state?.position}
            onPositionChange={handlePositionChange}
          />
        ) : (
          <ShogiBoard 
            position={shogiPosition}
            onPositionChange={setShogiPosition}
            size={450}
          />
        )}

      </div>
    </div>
  );
}
