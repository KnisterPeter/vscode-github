import { Agent } from 'http';

declare global {
  interface RequestInit {
    agent?: Agent;
  }
}
