"use client";

import { useState } from "react";
import { WeatherCard } from "@/components/WeatherCard";
import { ChessBoard } from "@/components/ChessBoard";

import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotSidebar } from "@copilotkit/react-ui";

export default function CopilotKitPage() {
  const [themeColor, setThemeColor] = useState("#6366f1");

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
      <CopilotSidebar
        clickOutsideToClose={false}
        defaultOpen={true}
        labels={{
          title: "Chess Assistant",
          initial: "👋 Hi! I'm your chess assistant. I can help you analyze positions, suggest moves, and explain chess concepts. The chessboard will update in real-time as we discuss the game!"
        }}
      />
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
        <h1 className="text-4xl font-bold text-white mb-2 text-center">Chess Game</h1>
        <p className="text-gray-200 text-center italic mb-6">Play chess with AI assistance! 🏆</p>
        <hr className="border-white/20 my-6" />
        
        <ChessBoard 
          position={state?.position}
          onPositionChange={handlePositionChange}
        />
        
        <div className="mt-4 text-center">
          <p className="text-white/80 text-sm">
            Current Position: {state?.position?.substring(0, 20)}...
          </p>
        </div>
      </div>
    </div>
  );
}
