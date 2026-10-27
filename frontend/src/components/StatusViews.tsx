import { CircleAlert, LoaderCircle } from 'lucide-react'

export function LoadingState({ label = 'Loading data' }: { label?: string }) {
  return (
    <div className="status-view" role="status">
      <LoaderCircle className="spin" size={20} aria-hidden />
      {label}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="status-view status-view--error" role="alert">
      <CircleAlert size={20} aria-hidden />
      <div>
        <strong>Couldn’t load data.</strong> {message}
        <div className="status-view__hint">Is the backend running on port 8000?</div>
      </div>
    </div>
  )
}
