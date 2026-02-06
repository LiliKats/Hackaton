import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { generateAvatarUrl, hasProfilePicture } from '@/utils/profilePictures';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department?: string;
  profilePictureUrl?: string;
  hasProfilePicture?: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar: string;
  status: 'Available' | 'On Leave' | 'Pending';
  statusColor: string;
  daysLeft: number;
}

const Teams: React.FC = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeamData = async () => {
      setLoading(true);
      try {
        // Fetch all users
        const usersResponse = await api.get<User[]>('/users');
        setAllUsers(usersResponse.data);
        console.log('👥 Loaded users for Teams page:', usersResponse.data);

        // Transform users to team members with profile pictures from backend
        const members: TeamMember[] = usersResponse.data.map(user => {
          const name = `${user.firstName} ${user.lastName}`;
          return {
            id: user.id,
            name,
            email: user.email,
            role: user.role || 'Employee',
            department: user.department || 'Engineering',
            avatar: user.profilePictureUrl || generateAvatarUrl(name), // Use backend profile picture or fallback
            status: Math.random() > 0.3 ? 'Available' : 'On Leave', // Random status for demo
            statusColor: Math.random() > 0.3 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
            daysLeft: Math.floor(Math.random() * 25) + 5 // Random days 5-30
          };
        });

        setTeamMembers(members);
        console.log(`👥 Generated ${members.length} team members with profile pictures for Teams page`);
      } catch (error) {
        console.error('Error fetching team data:', error);
        setTeamMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
        <p className="text-gray-600">
          Manage team members and view their leave status with profile pictures
          <span className="ml-2 text-gray-500">({teamMembers.length} members)</span>
        </p>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {teamMembers.map((member) => (
            <li key={member.id} className="px-6 py-4 hover:bg-gray-50 transition-colors duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div
                      className="relative cursor-pointer transform hover:scale-105 transition-transform duration-200"
                      title={`${member.name} - ${member.role}`}
                    >
                      <img
                        className="h-10 w-10 rounded-full border-2 border-gray-200 shadow-sm object-cover hover:border-indigo-300 transition-colors duration-200"
                        src={member.avatar}
                        alt={member.name}
                        onError={(e) => {
                          console.log(`❌ Profile picture failed to load for ${member.name}`);
                          // Fallback to initials if image fails to load
                          const target = e.target as HTMLImageElement;
                          const container = target.parentElement;
                          if (container) {
                            container.innerHTML = `
                              <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-gray-200 hover:border-indigo-300 transition-colors duration-200">
                                <span class="text-sm font-medium text-indigo-600">
                                  ${member.name.split(' ').map(n => n[0]).join('')}
                                </span>
                              </div>
                            `;
                          }
                        }}
                      />
                      {/* Show indicator for users with real profile pictures from backend */}
                      {allUsers.find(u => `${u.firstName} ${u.lastName}` === member.name)?.hasProfilePicture && (
                        <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-400 border-2 border-white rounded-full"
                             title="Real profile picture from database"></div>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{member.name}</div>
                    <div className="text-sm text-gray-500">{member.role} • {member.email}</div>
                    <div className="text-xs text-gray-400">{member.department}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${member.statusColor}`}>
                    {member.status}
                  </span>
                  <span className="text-sm text-gray-500">
                    {member.status === 'Available' ? `${member.daysLeft} days left` : 'Back soon'}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Teams;