import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { Button } from './Button';
import { Check, X, Crop as CropIcon } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;
  onComplete: (croppedFile: File) => void;
  onCancel: () => void;
}

// Helper to center the crop initially
function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onComplete, onCancel }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [aspect, setAspect] = useState<number | undefined>(undefined); // Free aspect ratio by default

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    // Initialize a centered crop covering 90% of the image
    const initialCrop = centerAspectCrop(width, height, width / height);
    setCrop(initialCrop);
    setCompletedCrop({
        ...initialCrop,
        unit: 'px',
        width: width * 0.9,
        height: height * 0.9,
        x: width * 0.05,
        y: height * 0.05
    } as PixelCrop);
  };

  const createCroppedImage = async () => {
    if (!imgRef.current || !completedCrop) return;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      // Re-create a file from the blob
      const file = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });
      onComplete(file);
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <CropIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Crop Image</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Drag corners to adjust visibility</p>
        </div>

        <div className="flex-1 overflow-auto p-6 flex justify-center bg-slate-50 dark:bg-slate-900/50 min-h-[300px]">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            className="max-h-[60vh]"
          >
            <img
              ref={imgRef}
              alt="Crop me"
              src={imageSrc}
              onLoad={onImageLoad}
              className="max-w-full max-h-[60vh] object-contain"
            />
          </ReactCrop>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} icon={<X className="w-4 h-4"/>} className="dark:text-slate-300 dark:hover:bg-slate-700">
            Cancel
          </Button>
          <Button onClick={createCroppedImage} icon={<Check className="w-4 h-4"/>}>
            Use Cropped Image
          </Button>
        </div>
      </div>
    </div>
  );
};