import type { Metadata } from 'next';
import LeaderboardScreen from '@/components/LeaderboardScreen';

export const metadata: Metadata = {
  title: 'Classement en direct — DevArena',
  description:
    'Scores en temps réel du défi DevArena — Club Dev ESGIS Bénin.',
};

export default function LeaderboardPage() {
  return <LeaderboardScreen />;
}
