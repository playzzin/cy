declare module 'mermaid';

declare module '*.css';

declare module '@svg-maps/south-korea' {
	const map: any;
	export default map;
}

declare module 'react-svg-map' {
	export const SVGMap: any;
	export const CheckboxSVGMap: any;
	export const RadioSVGMap: any;
}

declare module './pages/support/VehicleCardIntegratedPage' {
	import { FC } from 'react';
	const VehicleCardIntegratedPage: FC<any>;
	export default VehicleCardIntegratedPage;
	export const VehicleCardIntegratedPage: FC<any>;
}
