import type { ReactNode } from "react";

export function WindowFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-2 border-black bg-[#c0c0c0] shadow-[4px_4px_0_0_#000]">
      <div className="flex items-center justify-between border-b-2 border-black bg-[#000080] px-3 py-2 text-white">
        <span className="font-bold">{title}</span>
        <div className="flex gap-1">
          <WinButton label="_" />
          <WinButton label="□" />
          <WinButton label="X" />
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function WinButton({ label }: { label: string }) {
  return (
    <div className="flex h-5 w-5 items-center justify-center border border-black bg-[#c0c0c0] text-xs text-black">
      {label}
    </div>
  );
}

export function Panel({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-2 border-black bg-[#dfdfdf] p-3 shadow-[inset_-1px_-1px_0_0_#808080,inset_1px_1px_0_0_#fff]">
      {title ? (
        <div className="mb-3 border border-black bg-[#c0c0c0] px-2 py-1 font-bold">
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function Field({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-2">
      <span className="font-bold">{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  );
}

export function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black bg-[#c0c0c0] px-2 py-1 text-sm">
      <span className="font-bold">{label}:</span> {value}
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="border border-black px-2 py-1 text-left font-bold">{children}</th>
  );
}

export function Td({
  children,
  colSpan,
}: {
  children: ReactNode;
  colSpan?: number;
}) {
  return (
    <td className="border border-black px-2 py-1 align-top" colSpan={colSpan}>
      {children}
    </td>
  );
}
