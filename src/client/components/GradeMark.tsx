export function GradeMark({ grade, label }: { grade: string; label: string }) {
  const tone = /^[ABCD]$/i.test(grade) ? grade.toLowerCase() : 'u';
  return (
    <div className={`grade grade-${tone}`}>
      <span className="grade-letter">{grade}</span>
      <span className="grade-caption">{label}</span>
    </div>
  );
}
