type Props = {
  label?: string;
};

export default function LoadingState({ label }: Props) {
  return (
    <div className="loading-state">
      <div className="spinner" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
