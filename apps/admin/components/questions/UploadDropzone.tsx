"use client"
import { useCallback, useState } from "react"
import { Upload, FileText, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface UploadDropzoneProps {
  onUpload: (file: File) => Promise<void>
  accept?: string
  isLoading?: boolean
}

export function UploadDropzone({ onUpload, accept = ".docx,.pdf", isLoading }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [done, setDone] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setSelectedFile(file)
    setDone(false)
    await onUpload(file)
    setDone(true)
  }, [onUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
        dragging
          ? "border-[var(--primary)] bg-[color:var(--color-brand-50)]"
          : "border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--secondary)]"
      )}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-[var(--primary)]" />
          <p className="text-sm font-medium text-[var(--muted-foreground)]">Uploading and parsing…</p>
        </>
      ) : done ? (
        <>
          <CheckCircle2 className="h-10 w-10 text-[color:var(--color-success-500)]" />
          <p className="text-sm font-medium text-[color:var(--color-success-700)]">Upload complete!</p>
          <Button variant="outline" size="sm" onClick={() => { setDone(false); setSelectedFile(null) }}>Upload another</Button>
        </>
      ) : (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-brand-50)]">
            <Upload className="h-7 w-7 text-[var(--primary)]" />
          </div>
          <div>
            <p className="text-sm font-semibold">Drag & drop your file here</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">Supports .docx and .pdf files</p>
          </div>
          {selectedFile && (
            <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <FileText className="h-4 w-4" />
              {selectedFile.name}
            </div>
          )}
          <label className="cursor-pointer">
            <input
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <Button variant="outline" size="sm" asChild>
              <span>Browse files</span>
            </Button>
          </label>
        </>
      )}
    </div>
  )
}
