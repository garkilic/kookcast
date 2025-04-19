import React from 'react';
import { Link } from 'react-router-dom';
import SurfDiaryList from './SurfDiaryList';

const Profile: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Surf Diary</h2>
          <Link
            to="/surf-diary"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Add New Entry
          </Link>
        </div>
        
        <div className="mt-4">
          <SurfDiaryList />
        </div>
      </div>
    </div>
  );
};

export default Profile; 