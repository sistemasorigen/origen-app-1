import { useAuth } from '../contexts/AuthContext';
import { UserRole, CoordinatorVariant } from '../types';
import { hasRole } from '../services/authUtils';

export const useRole = () => {
    const { user } = useAuth();

    const isAnfitrion = hasRole(user, UserRole.ANFITRION);
    const isSuperAdmin = hasRole(user, UserRole.SUPER_ADMIN);
    const isGroupsAdmin = hasRole(user, UserRole.ADMIN_GROUPS);
    const isEncargadoGroups = hasRole(user, UserRole.ENCARGADO_GRUPOS);
    const isAdmin = isSuperAdmin || isGroupsAdmin;
    const canManageGroups = isAdmin || isEncargadoGroups;
    const isCoordinator = user?.roles?.includes(UserRole.COORDINATOR) ?? false;

    const isCoordinatorOf = (variant: CoordinatorVariant): boolean => {
        if (!user || !isCoordinator) return false;
        if (user.coordinatorVariants && user.coordinatorVariants.length > 0) {
            return user.coordinatorVariants.includes(variant);
        }
        // Fallback legacy para usuarios aún no migrados en memoria
        return user.coordinatorVariant === variant;
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
