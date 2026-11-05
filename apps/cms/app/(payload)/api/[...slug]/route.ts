import config from '@payload-config';
import { REST_GET, REST_POST, REST_PATCH, REST_DELETE, REST_OPTIONS } from '@payloadcms/next/routes';
export const GET=REST_GET(config), POST=REST_POST(config), PATCH=REST_PATCH(config),
  DELETE=REST_DELETE(config), OPTIONS=REST_OPTIONS(config);
