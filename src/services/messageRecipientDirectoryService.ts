import { getTeamScopedRows } from './teamScopedReadService';
import { userService, type UserData } from './userService';

export async function getMessageRecipientUsers(): Promise<UserData[]> {
    const scoped = await getTeamScopedRows<UserData>('message_recipients');
    // A denied scoped read must never fall back to the private users collection.
    return scoped === null ? userService.getAllUsers() : scoped;
}
