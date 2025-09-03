'use client';

import { useState } from 'react';
import { AddTokenModal } from './AddTokenModal';

interface AddTokenButtonProps {
  className?: string;
  onSuccess?: () => void;
}

export function AddTokenButton({ className = '', onSuccess }: AddTokenButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors ${className}`}
      >
        + Add Token
      </button>

      <AddTokenModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={onSuccess}
      />
    </>
  );
}