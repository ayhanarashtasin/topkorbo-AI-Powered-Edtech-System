import { ForumProvider } from '../../context/ForumContext';
import ForumLayout from './ForumLayout';

export default function ForumShell() {
  return (
    <ForumProvider>
      <ForumLayout />
    </ForumProvider>
  );
}
