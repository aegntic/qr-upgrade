import { PLAN_LIMITS } from "../../shared/plan-limits.mjs";

const rows = [
  { label: "Cloud designs", key: "cloudDesigns" },
  { label: "Dynamic links", key: "dynamicLinks" },
  { label: "Hosted pages", key: "hostedPages" },
  { label: "Uploaded files", key: "uploadedAssets" },
] as const;

export function PlanLimitTable() {
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Capacity</th>
          <th scope="col">Free</th>
          <th scope="col">Pro</th>
          <th scope="col">Brand</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.label}</th>
            <td>{PLAN_LIMITS.free[row.key]}</td>
            <td>{PLAN_LIMITS.pro[row.key]}</td>
            <td>{PLAN_LIMITS.brand[row.key]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
