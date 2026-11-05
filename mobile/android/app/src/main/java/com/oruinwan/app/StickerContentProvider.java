package com.oruinwan.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.UriMatcher;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.List;

/**
 * Sticker packs for WhatsApp ("Add to WhatsApp" in the sticker sheet), in the format of
 * WhatsApp's sticker API: WhatsApp reads the packs Oruinwan prepared (StickerExportPlugin) through
 * this provider. Only WhatsApp may read it (com.whatsapp.sticker.READ). Files live in
 * files/whatsapp-stickers/ (StickerPacks).
 */
public class StickerContentProvider extends ContentProvider {

    static final String METADATA = "metadata";
    static final String STICKERS = "stickers";
    static final String STICKERS_ASSET = "stickers_asset";

    private static final int METADATA_ALL = 1;
    private static final int METADATA_ONE = 2;
    private static final int STICKERS_ONE = 3;
    private static final int STICKER_FILE = 4;

    private UriMatcher matcher;

    static String authority(android.content.Context context) {
        return context.getPackageName() + ".stickercontentprovider";
    }

    @Override
    public boolean onCreate() {
        String auth = authority(getContext());
        matcher = new UriMatcher(UriMatcher.NO_MATCH);
        matcher.addURI(auth, METADATA, METADATA_ALL);
        matcher.addURI(auth, METADATA + "/*", METADATA_ONE);
        matcher.addURI(auth, STICKERS + "/*", STICKERS_ONE);
        matcher.addURI(auth, STICKERS_ASSET + "/*/*", STICKER_FILE);
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        JSONArray packs = StickerPacks.read(getContext());
        int match = matcher.match(uri);
        if (match == METADATA_ALL) return packCursor(packs, null);
        if (match == METADATA_ONE) return packCursor(packs, uri.getLastPathSegment());
        if (match == STICKERS_ONE) return stickerCursor(StickerPacks.find(packs, uri.getLastPathSegment()));
        throw new IllegalArgumentException("Unknown URI: " + uri);
    }

    private Cursor packCursor(JSONArray packs, String onlyId) {
        MatrixCursor c = new MatrixCursor(new String[] {
            "sticker_pack_identifier", "sticker_pack_name", "sticker_pack_publisher", "sticker_pack_icon",
            "android_play_store_link", "ios_app_download_link", "sticker_pack_publisher_email",
            "sticker_pack_publisher_website", "sticker_pack_privacy_policy_website",
            "sticker_pack_license_agreement_website", "image_data_version", "whatsapp_will_not_cache_stickers",
            "animated_sticker_pack",
        });
        for (int i = 0; i < packs.length(); i++) {
            JSONObject p = packs.optJSONObject(i);
            if (p == null) continue;
            String id = p.optString("identifier");
            if (onlyId != null && !onlyId.equals(id)) continue;
            c.addRow(new Object[] {
                id, p.optString("name"), p.optString("publisher", "Oruinwan"), "tray.png",
                "", "", "", "https://oruinwan.poelys.com", "https://oruinwan.poelys.com/privacy",
                "https://oruinwan.poelys.com/terms", p.optString("imageDataVersion", "1"), 0, p.optBoolean("animated") ? 1 : 0,
            });
        }
        c.setNotificationUri(getContext().getContentResolver(), Uri.parse("content://" + authority(getContext()) + "/" + METADATA));
        return c;
    }

    private Cursor stickerCursor(JSONObject pack) {
        MatrixCursor c = new MatrixCursor(new String[] { "sticker_file_name", "sticker_emoji", "sticker_accessibility_text" });
        if (pack == null) return c;
        JSONArray list = pack.optJSONArray("stickers");
        if (list == null) return c;
        for (int i = 0; i < list.length(); i++) {
            JSONObject s = list.optJSONObject(i);
            if (s == null) continue;
            c.addRow(new Object[] { s.optString("file"), s.optString("emoji", "😀"), s.optString("label", "Sticker") });
        }
        return c;
    }

    @Override
    public AssetFileDescriptor openAssetFile(Uri uri, String mode) throws FileNotFoundException {
        if (matcher.match(uri) != STICKER_FILE) throw new FileNotFoundException("Not a sticker file: " + uri);
        List<String> seg = uri.getPathSegments();
        String packId = seg.get(seg.size() - 2);
        String name = seg.get(seg.size() - 1);
        File file = StickerPacks.file(getContext(), packId, name);
        if (file == null || !file.isFile()) throw new FileNotFoundException(uri.toString());
        return new AssetFileDescriptor(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY), 0, AssetFileDescriptor.UNKNOWN_LENGTH);
    }

    @Override
    public String getType(Uri uri) {
        int match = matcher.match(uri);
        String auth = authority(getContext());
        if (match == METADATA_ALL) return "vnd.android.cursor.dir/vnd." + auth + "." + METADATA;
        if (match == METADATA_ONE) return "vnd.android.cursor.item/vnd." + auth + "." + METADATA;
        if (match == STICKERS_ONE) return "vnd.android.cursor.dir/vnd." + auth + "." + STICKERS;
        if (match == STICKER_FILE) return uri.getLastPathSegment().endsWith(".png") ? "image/png" : "image/webp";
        return null;
    }

    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] selectionArgs) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { throw new UnsupportedOperationException(); }
}
