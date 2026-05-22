import React, { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSun, faCloud, faCloudRain, faSnowflake, faBolt, faSmog, faSpinner, faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';

export interface DashboardWeatherLocationOption {
    key: string;
    label: string;
    latitude: number;
    longitude: number;
}

export const DASHBOARD_WEATHER_LOCATIONS: DashboardWeatherLocationOption[] = [
    { key: 'seoul', label: '서울', latitude: 37.5665, longitude: 126.9780 },
    { key: 'incheon', label: '인천', latitude: 37.4563, longitude: 126.7052 },
    { key: 'suwon', label: '수원', latitude: 37.2636, longitude: 127.0286 },
    { key: 'daejeon', label: '대전', latitude: 36.3504, longitude: 127.3845 },
    { key: 'daegu', label: '대구', latitude: 35.8714, longitude: 128.6014 },
    { key: 'busan', label: '부산', latitude: 35.1796, longitude: 129.0756 },
    { key: 'gwangju', label: '광주', latitude: 35.1595, longitude: 126.8526 },
    { key: 'jeju', label: '제주', latitude: 33.4996, longitude: 126.5312 },
];

interface WeatherData {
    current: {
        temperature: number;
        weatherCode: number;
    };
    daily: {
        time: string[];
        weatherCode: number[];
        maxTemp: number[];
        minTemp: number[];
    };
}

interface WeatherWidgetProps {
    locationKey?: string;
    className?: string;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ locationKey = 'seoul', className = '' }) => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const location = useMemo(() => (
        DASHBOARD_WEATHER_LOCATIONS.find((option) => option.key === locationKey) || DASHBOARD_WEATHER_LOCATIONS[0]
    ), [locationKey]);

    useEffect(() => {
        let isMounted = true;

        const fetchWeather = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul`
                );
                if (!response.ok) throw new Error('Weather data fetch failed');
                const data = await response.json();

                if (!isMounted) return;

                setWeather({
                    current: {
                        temperature: data.current.temperature_2m,
                        weatherCode: data.current.weather_code
                    },
                    daily: {
                        time: data.daily.time,
                        weatherCode: data.daily.weather_code,
                        maxTemp: data.daily.temperature_2m_max,
                        minTemp: data.daily.temperature_2m_min
                    }
                });
            } catch (err) {
                if (isMounted) setError('날씨 정보를 불러올 수 없습니다.');
                console.error(err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchWeather();

        return () => {
            isMounted = false;
        };
    }, [location.latitude, location.longitude]);

    const getWeatherIcon = (code: number) => {
        if (code === 0) return faSun;
        if (code >= 1 && code <= 3) return faCloud;
        if (code >= 51 && code <= 67) return faCloudRain;
        if (code >= 71 && code <= 77) return faSnowflake;
        if (code >= 80 && code <= 82) return faCloudRain;
        if (code >= 95 && code <= 99) return faBolt;
        return faSmog;
    };

    const getWeatherDescription = (code: number) => {
        if (code === 0) return '맑음';
        if (code >= 1 && code <= 3) return '구름 조금';
        if (code >= 45 && code <= 48) return '안개';
        if (code >= 51 && code <= 67) return '비';
        if (code >= 71 && code <= 77) return '눈';
        if (code >= 80 && code <= 82) return '소나기';
        if (code >= 95 && code <= 99) return '뇌우';
        return '흐림';
    };

    const getDayName = (dateStr: string) => {
        const date = new Date(dateStr);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return days[date.getDay()];
    };

    if (loading) return (
        <div className={`bg-white rounded-xl shadow-lg p-6 border border-slate-100 h-full flex items-center justify-center ${className}`}>
            <FontAwesomeIcon icon={faSpinner} spin className="text-brand-500 text-2xl" />
        </div>
    );

    if (error || !weather) return (
        <div className={`bg-white rounded-xl shadow-lg p-6 border border-slate-100 h-full flex items-center justify-center text-slate-500 text-sm ${className}`}>
            {error || '날씨 데이터 없음'}
        </div>
    );

    return (
        <div className={`bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl shadow-lg p-6 text-white h-full relative overflow-hidden ${className}`}>
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-white/10 rounded-full blur-xl" />

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-blue-200" />
                            {location.label}
                        </h3>
                        <p className="text-blue-100 text-sm">
                            {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
                        </p>
                    </div>
                    <div className="text-right">
                        <FontAwesomeIcon icon={getWeatherIcon(weather.current.weatherCode)} className="text-4xl text-yellow-300 mb-1" />
                        <p className="font-medium">{getWeatherDescription(weather.current.weatherCode)}</p>
                    </div>
                </div>

                <div className="flex items-end gap-2 mb-8">
                    <span className="text-5xl font-bold">{Math.round(weather.current.temperature)}°</span>
                    <span className="text-blue-100 mb-2">현재 기온</span>
                </div>

                {/* Weekly Forecast */}
                <div className="grid grid-cols-5 gap-2 text-center">
                    {weather.daily.time.slice(1, 6).map((date, index) => (
                        <div key={date} className="bg-white/10 rounded-lg p-2 backdrop-blur-sm">
                            <p className="text-xs text-blue-100 mb-1">{getDayName(date)}</p>
                            <FontAwesomeIcon
                                icon={getWeatherIcon(weather.daily.weatherCode[index + 1])}
                                className="text-lg my-1 text-white"
                            />
                            <p className="text-xs font-bold">{Math.round(weather.daily.maxTemp[index + 1])}°</p>
                            <p className="text-[10px] text-blue-200">{Math.round(weather.daily.minTemp[index + 1])}°</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WeatherWidget;
