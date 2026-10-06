// 标签徽章：支持自定义颜色
export function TagChip({ name, color = '#6b7280' }) {
  return (
    <span class="tag-chip" style={`border-color:${color};color:${color}`}>
      <span style={`width:8px;height:8px;border-radius:50%;background:${color};display:inline-block`} />
      {name}
    </span>
  );
}
