"use client";

import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useCallback } from "react";

interface ChessBoardProps {
  position?: string;
  onPositionChange?: (position: string) => void;
}

export function ChessBoard({ position, onPositionChange }: ChessBoardProps) {
  const onDrop = useCallback(({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare) return false;
    
    try {
      // Create a temporary game to validate the move
      const game = new Chess(position);
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q", // Always promote to queen
      });
      
      if (move) {
        // Move is valid, notify parent of new position
        onPositionChange?.(game.fen());
        return true;
      }
    } catch (error) {
      console.error("Invalid move:", error);
    }
    return false;
  }, [position, onPositionChange]);

  return (
    <div className="flex justify-center">
      <Chessboard
        options={{
          position,
          onPieceDrop: onDrop,
          boardStyle: {
            borderRadius: "4px",
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
            width: "400px",
            height: "400px",
          },
          darkSquareStyle: {
            backgroundColor: "#b58863",
          },
          lightSquareStyle: {
            backgroundColor: "#f0d9b5",
          },
        }}
      />
    </div>
  );
}