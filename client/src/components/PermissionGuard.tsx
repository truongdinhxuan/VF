import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { PermissionInput } from '../constants/permissions';
import { useAuth } from '../context/AuthContext';

interface PermissionGuardProps {
  children: ReactNode;
  permission?: PermissionInput;
  anyOf?: readonly PermissionInput[];
  allOf?: readonly PermissionInput[];
}

export const PermissionGuard = ({
  children,
  permission,
  anyOf,
  allOf,
}: PermissionGuardProps) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  const allowed = (!permission || hasPermission(permission))
    && (!anyOf || hasAnyPermission(anyOf))
    && (!allOf || hasAllPermissions(allOf));

  return allowed
    ? children
    : <Navigate to="/403-unauthorized" replace />;
};
