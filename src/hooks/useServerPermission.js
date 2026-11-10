"use client";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";

export function useServerPermission(permissionId) {
  const { currentServer, members, roles } = useServerStore();
  const { user } = useAuthStore();

  if (!currentServer || !user) return false;

  // Owner always has permission
  if (currentServer.ownerId === user.uid) return true;

  // Find current user's member record
  const currentMember = members.find(m => m.id === user.uid);
  if (!currentMember) return false;

  // Check roles
  // Note: member.roles is an array of role IDs
  if (!currentMember.roles || currentMember.roles.length === 0) return false;

  const userRoleObjects = roles.filter(r => currentMember.roles.includes(r.id));
  
  // Check if any role has the permission
  // OR if they have ADMIN permission (if we implement that, but for now specific check)
  return userRoleObjects.some(role => role.permissions && role.permissions.includes(permissionId));
}
