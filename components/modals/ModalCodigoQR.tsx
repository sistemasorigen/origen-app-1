import React from 'react';
import NeoModal from '../ui/NeoModal';
import { QrCode } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  qrUrl: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, title, qrUrl }) => {
  return (
    <NeoModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      <div className="flex flex-col items-center">
        {/* QR Display */}
        <div className="bg-white border-4 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
          <img src={qrUrl} alt="QR Code" className="w-48 h-48 object-contain" />
        </div>

        <p className="mt-4 text-[10px] font-bold uppercase text-neutral-400 text-center">
          Escanea este código para acceder directamente.
        </p>
      </div>
    </NeoModal>
  );
};

export default QRCodeModal;