import React from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../../services/googleAnalytics';

const AnalyticsRouteTracker: React.FC = () => {
  const location = useLocation();

  React.useEffect(() => {
    const pagePath = `${location.pathname}${location.search}${location.hash}`;
    trackPageView(pagePath);
  }, [location.pathname, location.search, location.hash]);

  return null;
};

export default AnalyticsRouteTracker;

