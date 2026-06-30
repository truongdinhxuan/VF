import React, { useState } from "react";
import { DataTable, type Column } from "../../../components/admin/DataTable" // Import đường dẫn phù hợp
import {type IUser} from "../../../interfaces"; // Import đường dẫn phù hợp
// 1. Định nghĩa Data Type

// 2. Mock Data (Dữ liệu mẫu giống trong ảnh)
// --- MOCK DATA THEO CHUẨN IUser ---
const MOCK_USERS: IUser[] = [
  {
    token: "token-1",
    publicData: {
      email: "jane.cooper@vinfast.vn",
      first_name: "Jane",
      middle_name: "",
      last_name: "Cooper",
      vinfast_id: "VF0001",
      avatar_url: "https://i.pravatar.cc/150?img=1",
      phone_number: "0901234567",
      position: 1,
      managed_by: 0,
      role: "Admin",
      create_at: new Date("2024-01-15"),
      updated_at: new Date("2024-01-15"),
    },
  },
  {
    token: "token-2",
    publicData: {
      email: "cody.fisher@vinfast.vn",
      first_name: "Cody",
      middle_name: "Van",
      last_name: "Fisher",
      vinfast_id: "VF0002",
      avatar_url: "https://i.pravatar.cc/150?img=11",
      phone_number: "0912345678",
      position: 2,
      managed_by: 1,
      role: "Owner",
      create_at: new Date("2023-11-20"),
      updated_at: new Date("2024-02-10"),
    },
  },
  {
    token: "token-3",
    publicData: {
      email: "esther.howard@vinfast.vn",
      first_name: "Esther",
      middle_name: "",
      last_name: "Howard",
      vinfast_id: "VF0003",
      avatar_url: "https://i.pravatar.cc/150?img=5",
      phone_number: "0923456789",
      position: 3,
      managed_by: 1,
      role: "Member",
      create_at: new Date("2024-03-05"),
      updated_at: new Date("2024-03-05"),
    },
  },
];

 const UserHomePage = () => {
  const [roleFilter, setRoleFilter] = useState("All");
  
  // Filter dữ liệu thêm nếu cần (Dropdown Role)
  const filteredUsers = MOCK_USERS.filter((user) =>
    roleFilter === "All" ? true : user.publicData.role === roleFilter
  );

  // 3. Định nghĩa cấu trúc các cột (Cột nào cần Custom HTML thì dùng `render`)
  const columns: Column<IUser>[] = [
    {
      header: "NAME",
      accessor: "name", // Cần truyền accessor dummy, data thật lấy qua render
      render: (user) => {
        const { first_name, middle_name, last_name, avatar_url, email } = user.publicData;
        // Ghép tên (nếu có tên đệm)
        const fullName = [last_name, middle_name, first_name].filter(Boolean).join(" ");
        
        return (
          <div className="flex items-center gap-3">
            <img src={avatar_url} alt={first_name} className="h-10 w-10 rounded-full object-cover" />
            <div>
              <div className="font-medium text-slate-900">{fullName}</div>
              <div className="text-slate-500">{email}</div>
            </div>
          </div>
        );
      },
    },
    {
      header: "VINFAST ID",
      accessor: "vinfast_id",
      render: (user) => <span className="font-medium">{user.publicData.vinfast_id}</span>,
    },
    {
      header: "PHONE",
      accessor: "phone_number",
      render: (user) => <span>{user.publicData.phone_number}</span>,
    },
    {
      header: "ROLE",
      accessor: "role",
      render: (user) => {
        const role = user.publicData.role;
        let badgeStyle = "bg-slate-100 text-slate-700"; // Mặc định
        
        if (role === "Admin") badgeStyle = "bg-green-100 text-green-700";
        if (role === "Owner") badgeStyle = "bg-amber-100 text-amber-700";
        if (role === "Member") badgeStyle = "bg-blue-100 text-blue-700";

        return (
          <span className={`rounded-full px-3 py-1 text-xs font-bold tracking-wide ${badgeStyle}`}>
            {role}
          </span>
        );
      },
    },
    {
      header: "JOINED DATE",
      accessor: "create_at",
      render: (user) => (
        <span>
          {user.publicData.create_at.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      header: "ACTIONS",
      accessor: "actions",
      render: (user) => (
        <button
          onClick={() => alert(`View details for ${user.publicData.first_name}`)}
          className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
        >
          Edit
        </button>
      ),
    },
  ];

  return (
    <div className="p-8 bg-slate-100 min-h-screen">
      <div className="mb-6 flex items-center gap-2 text-2xl font-bold text-slate-800">
        React Table + Tailwind CSS = ❤️
      </div>

      <DataTable
        data={filteredUsers}
        columns={columns}
        searchPlaceholder="18 records..."
        // Chèn thêm Dropdown Filter "Role" vào Top Toolbar
        renderTopToolbar={() => (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Role:</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm outline-none transition-all focus:border-blue-500"
            >
              <option value="All">All</option>
              <option value="Admin">Admin</option>
              <option value="Owner">Owner</option>
              <option value="Member">Member</option>
            </select>
          </div>
        )}
      />
    </div>
  );
};

export default UserHomePage