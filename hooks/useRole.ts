import { useAuth } from '../contexts/AuthContext';
import { UserRole, CoordinatorVariant } from '../types';

export const useRole = () => {
    const { user } = useAuth();

    const isAnfitrion = user?.role === UserRole.ANFITRION;
    const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
    const isGroupsAdmin = user?.role === UserRole.ADMIN_GROUPS;
    const isEncargadoGroups = user?.role === UserRole.ENCARGADO_GRUPOS;
    const isAdmin = isSuperAdmin || isGroupsAdmin;
    const canManageGroups = isAdmin || isEncargadoGroups;
    const isCoordinator = user?.roles?.includes(UserRole.COORDINATOR) ?? false;

    const isCoordinatorOf = (variant: CoordinatorVariant): boolean => {
        if (!user) return false;
        return isCoordinator && user.coordinatorVariant === variant;
    };

    const canCreateGroup = isAnfitrion || isAdmin;
    const canBrowseGroups = true;
    const canJoinGroups = !!user;
    const canViewGroupDetails = true;

    return {
        isAnfitrion,
        isSuperAdmin,
        isGroupsAdmin,
        isEncargadoGroups,
        isAdmin,
        canManageGroups,
        isCoordinator,
        isCoordinatorOf,
        canCreateGroup,
        canBrowseGroups,
        canJoinGroups,
        canViewGroupDetails,
        user
    };
};

export default useRole;
