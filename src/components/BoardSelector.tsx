import { useState } from 'react';

interface BoardOption {
  id: string;
  label: string;
  description: string;
}

interface BoardSelectorProps {
  selectedBoards: string[];
  onBoardsChange: (boards: string[]) => void;
  className?: string;
}

const boardOptions: BoardOption[] = [
  { id: 'shortboard', label: 'Shortboard', description: '5\'6" - 6\'4" performance board' },
  { id: 'funboard', label: 'Funboard/Mini-mal', description: '7\'0" - 8\'0" versatile board' },
  { id: 'longboard', label: 'Longboard', description: '9\'0"+ classic longboard' },
  { id: 'fish', label: 'Fish', description: '5\'4" - 6\'0" retro fish' },
  { id: 'foamie', label: 'Soft-top/Foamie', description: 'Beginner-friendly foam board' },
  { id: 'sup', label: 'SUP', description: 'Stand-up paddleboard' }
];

export default function BoardSelector({ selectedBoards, onBoardsChange, className = '' }: BoardSelectorProps) {
  const toggleBoard = (boardId: string) => {
    onBoardsChange(
      selectedBoards.includes(boardId)
        ? selectedBoards.filter(id => id !== boardId)
        : [...selectedBoards, boardId]
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <h4 className="font-medium text-gray-900">What type of board(s) do you ride? <span className="text-sm text-gray-500">(Select all that apply)</span></h4>
        <p className="text-sm text-gray-500 mt-1">Select the boards you currently ride or are interested in riding</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {boardOptions.map((board) => (
          <button
            key={board.id}
            type="button"
            onClick={() => toggleBoard(board.id)}
            className={`p-4 rounded-lg border text-left transition-all ${
              selectedBoards.includes(board.id)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-200'
            }`}
          >
            <h5 className="font-medium text-gray-900">{board.label}</h5>
            <p className="text-sm text-gray-600 mt-1">{board.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
} 