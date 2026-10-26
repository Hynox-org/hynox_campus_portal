"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table";
import type { InstitutionUser } from "@/services/institution";

export default function InstitutionUserTable({ users, onView, onDelete }: {
  users: InstitutionUser[];
  onView: (user: InstitutionUser) => void;
  onDelete: (user: InstitutionUser) => void;
}) {
  const columns: ColumnDef<InstitutionUser>[] = [
    { header: "User Details", accessorKey: "full_name", cell: ({ row }) => (
      <button type="button" onClick={() => onView(row.original)} aria-label={`View ${row.original.email}`} className="text-left cursor-pointer">
        <span className="block font-semibold">{row.original.full_name || "N/A"}</span>
        <span className="block text-[#C2C6D1] text-[11px]">{row.original.email}</span>
      </button>
    ) },
    { header: "Assigned Role", cell: ({ row }) => {
      const roles = row.original.roles;
      const [label, color] = roles.some(role => ["super_admin", "institution_admin"].includes(role)) ? ["Admin", "#2FBF71"]
        : roles.some(role => ["teacher", "trainer"].includes(role)) ? ["Teacher", "#6E79F4"]
        : roles.includes("student") ? ["Student", "#22D3EE"] : ["Member", "#C2C6D1"];
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border" style={{ color, backgroundColor: `${color}1a`, borderColor: `${color}33` }}>{label}</span>;
    } },
    { header: "Status", accessorKey: "status", cell: ({ row }) => {
      const status = row.original.status;
      const color = ["invited", "pending_activation"].includes(status) ? "#F5B04A"
        : ["suspended", "inactive", "blocked"].includes(status) ? "#F0555D" : "#2FBF71";
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border" style={{ color, backgroundColor: `${color}1a`, borderColor: `${color}33` }}>{status}</span>;
    } },
    { header: "Joined Date", accessorKey: "created_at", cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString() },
    { header: "Actions", cell: ({ row }) => (
      <button type="button" onClick={() => onDelete(row.original)} aria-label={`Delete ${row.original.email}`} title="Delete User Completely" className="p-1 rounded text-red-600 cursor-pointer">
        <Trash2 size={12} />
      </button>
    ) },
  ];
  return <div className="overflow-x-auto"><DataTable columns={columns} data={users} /></div>;
}
