export default function LoadingProgress({ message }: { message: string }) {
  return (
    <div className="loading-progress" role="status">
      <progress aria-label={message} />
      <span>{message}</span>
    </div>
  );
}
