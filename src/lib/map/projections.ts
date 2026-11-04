import { geoConicEqualArea, geoEqualEarth, type GeoProjection } from 'd3-geo';

/**
 * Map projections shared by scripts/make-maps.ts (engraved base maps in static/maps/) and MapView
 * (stars and routes drawn on top). Both MUST use these exact definitions, in the same viewBox.
 * Pure module: no side effects, safe to import from the browser.
 */
export type MapName = 'world' | 'atlantic';

export type MapDef = {
	/** viewBox width and height. */
	W: number;
	H: number;
	/** world-atlas file (Natural Earth, public domain) used for the land layer. */
	atlas: 'land-110m.json' | 'land-50m.json';
	/** graticule step, degrees. */
	step: number;
	/** true: clip to the sphere and draw its outline. */
	sphere: boolean;
	make: () => GeoProjection;
};

export const MAPS: Record<MapName, MapDef> = {
	world: {
		W: 1000,
		H: 500,
		atlas: 'land-110m.json',
		step: 15,
		sphere: true,
		make: () =>
			geoEqualEarth()
				.rotate([-10, 0])
				.fitExtent(
					[
						[10, 10],
						[990, 490]
					],
					{ type: 'Sphere' }
				)
	},
	atlantic: {
		W: 1000,
		H: 440,
		atlas: 'land-50m.json',
		step: 10,
		sphere: false,
		make: () =>
			geoConicEqualArea()
				.parallels([35, 60])
				.rotate([42, 0])
				.fitExtent(
					[
						[20, 20],
						[980, 420]
					],
					{
						type: 'MultiPoint',
						coordinates: [
							[-92, 36],
							[-92, 52],
							[8, 47],
							[8, 58],
							[-40, 62],
							[-40, 33]
						]
					}
				)
				.clipExtent([
					[0, 0],
					[1000, 440]
				])
	}
};
