import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSun, faCloud, faCloudRain, faSnowflake, faBolt, faSmog, faSpinner, faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';

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

const WeatherWidget: React.FC = () => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Default location: Seoul
    const LAT = 37.5665;
    const LON = 126.9780;

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const response = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo`
                );
                if (!response.ok) throw new Error('Weather data fetch failed');
                const data = await response.json();

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
                setError('날씨 정보를 불러올 수 없습니다.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchWeather();
    }, []);

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
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-100 h-full flex items-center justify-center">
            <FontAwesomeIcon icon={faSpinner} spin className="text-brand-500 text-2xl" />
        </div>
    );

    if (error || !weather) return (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-100 h-full flex items-center justify-center text-slate-500 text-sm">
            {error || '날씨 데이터 없음'}
        </div>
    );

    return (
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white h-full relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-blue-200" />
                            서울
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
