type Props = {
  message: string;
};

export default function EmptyState({ message }: Props) {
  return (
    <div className="empty-state">
      <span>{message}</span>
    </div>
  );
}
