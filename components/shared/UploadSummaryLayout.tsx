import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface UploadProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: {
    total: number;
    successful: number;
    failed: number;
    retried: number;
  };
  uploading: boolean;
}

export default function UploadProgressModal({
  isOpen,
  onClose,
  stats,
  uploading,
}: UploadProgressModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => !uploading && onClose()}>
      <DialogContent className="max-w-md rounded-lg bg-white shadow-lg border border-blue-200">
        <DialogHeader>
          <DialogTitle className="text-blue-700 text-lg font-semibold">
            Upload Progress
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-4 py-2 text-gray-800">
          <div className="flex justify-between border-b border-blue-100 pb-2">
            <span>Total Vouchers</span>
            <span className="font-medium">{stats.total}</span>
          </div>
          <div className="flex justify-between border-b border-blue-100 pb-2">
            <span className="text-green-600 font-semibold">
              Successful Uploads
            </span>
            <span className="font-semibold text-green-600">
              {stats.successful}
            </span>
          </div>
          <div className="flex justify-between border-b border-blue-100 pb-2">
            <span className="text-red-600 font-semibold">Failed Uploads</span>
            <span className="font-semibold text-red-600">{stats.failed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-600 font-semibold">Retries</span>
            <span className="font-semibold text-blue-600">{stats.retried}</span>
          </div>
          {uploading && (
            <div className="flex items-center gap-2 mt-4 text-blue-700">
              <Loader2 className="animate-spin" size={20} />
              <span>Uploading...</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? "Uploading, please wait..." : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
