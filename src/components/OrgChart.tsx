import { Link } from 'react-router-dom';
import type { Account, Person } from '../types';

interface RawNode {
  name: string;
  title: string;
  reports_to?: string | null;
}

interface TreeNode extends RawNode {
  id: string;
  level: string;
  children: TreeNode[];
  linkedPersonId?: string;
  avatarColor: string;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981', '#f97316'];

function findParent(node: RawNode, all: TreeNode[]): TreeNode | null {
  const rt = (node.reports_to || '').toLowerCase().trim();
  if (!rt || rt.startsWith('board') || rt === 'null') return null;

  // Match by first name inside the reports_to string
  for (const candidate of all) {
    const firstName = candidate.name.split(' ')[0].toLowerCase();
    if (firstName.length > 2 && rt.includes(firstName)) return candidate;
  }
  // Match by title keyword
  for (const candidate of all) {
    const titleWords = candidate.title.toLowerCase().split(/[\s/,()]+/).filter(w => w.length > 3);
    for (const word of titleWords) {
      if (rt.includes(word)) return candidate;
    }
  }
  return null;
}

function buildTree(orgChart: NonNullable<Account['orgChart']>, people: Person[]): TreeNode[] {
  const sections: { data: RawNode[]; level: string }[] = [
    { data: orgChart.c_level ?? [], level: 'c_level' },
    { data: orgChart.vp_director ?? [], level: 'vp_director' },
    { data: orgChart.manager_ic ?? [], level: 'manager_ic' },
    { data: orgChart.unknown ?? [], level: 'unknown' },
  ];

  const allNodes: TreeNode[] = [];
  let ci = 0;
  for (const { data, level } of sections) {
    for (const p of data) {
      const linked = people.find(person =>
        person.name.toLowerCase().includes(p.name.split(' ')[0].toLowerCase()) ||
        p.name.toLowerCase().includes(person.name.split(' ')[0].toLowerCase())
      );
      allNodes.push({ ...p, id: `${p.name}-${level}`, level, children: [], linkedPersonId: linked?.id, avatarColor: COLORS[ci++ % COLORS.length] });
    }
  }

  const childIds = new Set<string>();
  for (const node of allNodes) {
    const parent = findParent(node, allNodes.filter(n => n.id !== node.id));
    if (parent) {
      parent.children.push(node);
      childIds.add(node.id);
    }
  }
  return allNodes.filter(n => !childIds.has(n.id));
}

const LEVEL_BORDER: Record<string, string> = {
  c_level: '#7c3aed',
  vp_director: '#6366f1',
  manager_ic: '#d1d5db',
  unknown: '#d1d5db',
};

function NodeCard({ node, accountId }: { node: TreeNode; accountId: string }) {
  const initials = node.name.split(' ').map(n => n[0]).slice(0, 2).join('');
  const borderColor = LEVEL_BORDER[node.level] ?? '#d1d5db';

  const inner = (
    <div style={{ borderColor }}
      className="w-36 rounded-xl border-2 bg-white p-3 text-center shadow-sm hover:shadow-md transition-shadow cursor-default">
      <div className="w-9 h-9 rounded-xl mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ background: node.avatarColor }}>
        {initials}
      </div>
      <p className="text-xs font-bold text-gray-900 leading-tight">{node.name}</p>
      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{node.title}</p>
    </div>
  );

  if (node.linkedPersonId) {
    return (
      <Link to={`/accounts/${accountId}/people/${node.linkedPersonId}`}
        className="block hover:scale-105 transition-transform">
        {inner}
      </Link>
    );
  }
  return inner;
}

function OrgNode({ node, accountId }: { node: TreeNode; accountId: string }) {
  return (
    <div className="org-node">
      <NodeCard node={node} accountId={accountId} />
      {node.children.length > 0 && (
        <ul className="org-children">
          {node.children.map(child => (
            <li key={child.id} className="org-child">
              <OrgNode node={child} accountId={accountId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OrgChart({ orgChart, people, accountId }: {
  orgChart: NonNullable<Account['orgChart']>;
  people: Person[];
  accountId: string;
}) {
  const roots = buildTree(orgChart, people);

  return (
    <>
      <style>{`
        .org-tree {
          display: flex;
          justify-content: center;
          padding: 24px 32px 32px;
          min-width: max-content;
        }
        .org-node {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .org-children {
          display: flex;
          padding-top: 0;
          margin: 0;
          list-style: none;
          position: relative;
        }
        /* vertical stem from parent card down to horizontal bar */
        .org-children::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 1px;
          height: 24px;
          background: #d1d5db;
        }
        /* each child li adds its own vertical stem */
        .org-child {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 10px;
          position: relative;
        }
        /* vertical line from horizontal bar down to each child's card */
        .org-child::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 1px;
          height: 24px;
          background: #d1d5db;
        }
        /* horizontal line connecting siblings — spans full width of each child */
        .org-child::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: #d1d5db;
        }
        /* clip left half for first child, right half for last */
        .org-child:first-child::after { left: 50%; }
        .org-child:last-child::after  { right: 50%; }
        /* single child: no horizontal bar needed */
        .org-child:first-child:last-child::after { display: none; }
        /* push cards down below the horizontal bar */
        .org-child > * { margin-top: 24px; }
      `}</style>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-gray-50/50">
        <div className="org-tree">
          {roots.map(root => (
            <div key={root.id} className="px-4">
              <OrgNode node={root} accountId={accountId} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
