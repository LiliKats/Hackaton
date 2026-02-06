// Shared profile picture mapping for all users across the application
export const profilePictureMap: Record<string, string> = {
  // Admin and management
  'Admin User': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face&auto=format',
  'Manager Johnson': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face&auto=format',

  // Employees
  'John Doe': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format',
  'Jane Smith': 'https://images.unsplash.com/photo-1494790108755-2616b9c68a3b?w=150&h=150&fit=crop&crop=face&auto=format',
  'Mike Johnson': 'https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?w=150&h=150&fit=crop&crop=face&auto=format',
  'Sarah Wilson': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face&auto=format',

  // Additional backup employees
  'Emily Davis': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face&auto=format',
  'David Brown': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face&auto=format',
  'Lisa Anderson': 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=150&h=150&fit=crop&crop=face&auto=format',
  'Robert Taylor': 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face&auto=format'
};

/**
 * Get profile picture URL for a user by name
 */
export const getProfilePictureUrl = (name: string): string | null => {
  return profilePictureMap[name] || null;
};

/**
 * Generate avatar URL with fallback to initials if no profile picture exists
 */
export const generateAvatarUrl = (name: string): string => {
  // First try to get a real profile picture
  const profilePicture = getProfilePictureUrl(name);
  if (profilePicture) {
    console.log(`🖼️ Using real profile picture for ${name}:`, profilePicture);
    return profilePicture;
  }

  // Fallback to generated avatar with initials
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  const colors = ['4F46E5', '7C3AED', 'DB2777', 'DC2626', 'EA580C', '059669', '0891B2'];
  const colorIndex = name.length % colors.length;
  const bgColor = colors[colorIndex];

  const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${bgColor}&color=fff&size=64&font-size=0.5&rounded=true&format=svg`;
  console.log(`🖼️ Generated fallback avatar for ${name}:`, url);
  return url;
};

/**
 * Check if a user has a real profile picture
 */
export const hasProfilePicture = (name: string): boolean => {
  return !!profilePictureMap[name];
};