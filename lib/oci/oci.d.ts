import { Archive, LoadArchiveOpts } from '../types/oci/oci';
export declare class OCI {
    static loadArchive(opts: LoadArchiveOpts): Promise<Archive>;
    private static isIndex;
    private static isManifest;
    private static isImage;
    private static extractBlob;
    private static streamToJson;
}
