/**
 * ForumShell - Entry point for the forum feature.
 *
 * Wraps ForumLayout with the ForumProvider context so all child components
 * (feed, post cards, compose form, etc.) have access to shared forum state
 * such as the current user, WebSocket subscriptions, and mutation helpers.
 */
import { ForumProvider } from '../../context/ForumContext';
import ForumLayout from './ForumLayout';

export default function ForumShell() {
  return (
    <ForumProvider>
      <ForumLayout />
    </ForumProvider>
  );
}
