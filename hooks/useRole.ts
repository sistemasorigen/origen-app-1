import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

/**
 * Hook to check user role capabilities.
 * Anfitrión = Regular user with exclusive privilege to create groups.
 */
export const useRole = () => {
    const { currentUser } = useAuth();

    const isAnfitrion = currentUser?.role === UserRole.ANFITRION;
    const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
    const isGroupsAdmin = currentUser?.role === UserRole.ADMIN_GROUPS;
    const isAdmin = isSuperAdmin || isGroupsAdmin;

    // Can create groups: Anfitrión, Admin Groups, or Super Admin
    const canCreateGroup = isAnfitrion || isAdmin;

    // Regular user capabilities (shared by Anfitrión and Viewer)
    const canBrowseGroups = true;
    const canJoinGroups = !!currentUser;
    const canViewGroupDetails = true;

    return {
        isAnfitrion,
        isSuperAdmin,
        isGroupsAdmin,
        isAdmin,
        canCreateGroup,
        canBrowseGroups,
        canJoinGroups,
        canViewGroupDetails,
        currentUser
    };
};

export default useRole;
