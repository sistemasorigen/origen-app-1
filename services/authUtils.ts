/**
 * Authorization Utilities for Multi-Role System
 * 
 * Provides helper functions to check user roles in a multi-role environment.
 * Supports both the new `roles` array and legacy `role` single value.
 */

import { User, UserRole } from '../types';

/**
 * Get all roles for a user.
 * Handles both new multi-role system and legacy single role.
 */
export function getUserRoles(user: User | null | undefined): UserRole[] {
    if (!user) return [];

    // Prefer new roles array if present
    if (user.roles && user.roles.length > 0) {
        return user.roles;
    }

    // Fallback to legacy single role
    if (user.role) {
        return [user.role];
    }

    return [];
}

/**
 * Check if user has SUPER_ADMIN role.
 * SUPER_ADMIN has access to everything.
 */
export function isSuperAdmin(user: User | null | undefined): boolean {
    const roles = getUserRoles(user);
    return roles.includes(UserRole.SUPER_ADMIN);
}

/**
 * Check if user has a specific role.
 * SUPER_ADMIN automatically passes all role checks.
 * 
 * @param user - The user to check
 * @param requiredRole - Single role or array of roles (any match = true)
 * @returns true if user has the required role(s)
 */
export function hasRole(
    user: User | null | undefined,
    requiredRole: UserRole | UserRole[]
): boolean {
    if (!user) return false;

    const userRoles = getUserRoles(user);

    // SUPER_ADMIN override - always has access
    if (userRoles.includes(UserRole.SUPER_ADMIN)) {
        return true;
    }

    // Check single role
    if (!Array.isArray(requiredRole)) {
        return userRoles.includes(requiredRole);
    }

    // Check any role in array matches
    return requiredRole.some(role => userRoles.includes(role));
}

/**
 * Check if user has ALL of the specified roles.
 * SUPER_ADMIN automatically passes.
 */
export function hasAllRoles(
    user: User | null | undefined,
    requiredRoles: UserRole[]
): boolean {
    if (!user) return false;

    const userRoles = getUserRoles(user);

    // SUPER_ADMIN override
    if (userRoles.includes(UserRole.SUPER_ADMIN)) {
        return true;
    }

    return requiredRoles.every(role => userRoles.includes(role));
}

/**
 * Check if user can access a specific system module.
 * Maps module names to required roles.
 */
export function canAccessModule(
    user: User | null | undefined,
    module: 'GROUPS' | 'PUNTO' | 'STORE' | 'ALABANZA' | 'ADMIN'
): boolean {
    if (!user) return false;

    // SUPER_ADMIN can access everything
    if (isSuperAdmin(user)) return true;

    const userRoles = getUserRoles(user);

    switch (module) {
        case 'ADMIN':
            // Only SUPER_ADMIN can access full admin panel
            return false;

        case 'GROUPS':
            return hasRole(user, [
                UserRole.ADMIN_GROUPS,
                UserRole.ANFITRION,
                UserRole.PASTOR
            ]);

        case 'PUNTO':
            return hasRole(user, [
                UserRole.ADMIN_PUNTO,
                UserRole.ENCARGADO_PUNTO,
                UserRole.VOLUNTARIO_INFO
            ]) || (
                    user.role === UserRole.ANFITRION &&
                    user.volunteerRoles?.includes('PUNTO')
                );

        case 'STORE':
            return hasRole(user, [
                UserRole.ADMIN_STORE
            ]) || (
                    user.role === UserRole.ANFITRION &&
                    user.volunteerRoles?.includes('STORE')
                );

        case 'ALABANZA':
            return hasRole(user, [
                UserRole.ADMIN_ALABANZA
            ]);

        default:
            return false;
    }
}

/**
 * Get a display-friendly list of role names
 */
export function getRoleDisplayNames(roles: UserRole[]): string[] {
    const displayNames: Record<UserRole, string> = {
        [UserRole.SUPER_ADMIN]: 'Super Admin',
        [UserRole.PASTOR]: 'Pastor',
        [UserRole.ADMIN_PUNTO]: 'Admin Punto',
        [UserRole.ADMIN_GROUPS]: 'Admin Grupos',
        [UserRole.ADMIN_STORE]: 'Admin Store',
        [UserRole.ADMIN_ALABANZA]: 'Admin Alabanza',
        [UserRole.ANFITRION]: 'Anfitrión',
        [UserRole.VIEWER]: 'Usuario',
        [UserRole.VOLUNTEER]: 'Voluntario',
        [UserRole.VOLUNTARIO]: 'Voluntario',
        [UserRole.VOLUNTARIO_INFO]: 'Vol. Punto Info',
        [UserRole.VOLUNTARIO_GRUPOS]: 'Vol. Grupos',
        [UserRole.ENCARGADO_PUNTO]: 'Encargado Punto',
        [UserRole.ENCARGADO_GRUPOS]: 'Encargado Grupos',
        [UserRole.ENCARGADO_STORE]: 'Encargado Store',
        [UserRole.ENCARGADO_ALABANZA]: 'Encargado Alabanza',
        [UserRole.USUARIO]: 'Usuario',
        [UserRole.REPORTES]: 'Reportes'
    };

    return roles.map(role => displayNames[role] || role);
}
