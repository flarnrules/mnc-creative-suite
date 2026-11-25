# MNC Creative Suite for GitHub Pages

The v0.9.23 browser edition opens to **Current Designs**. Pick a type and design, click **New card**, and pick an image in **Artwork**. Write the card in **Card Designer** and open **Foil Lab** from its preview. The landing page links to [MNCDB](https://flarnrules.github.io/mnc-db/).

In **Layout Designer**, choose **New design** or open a saved card. **Save design** can add a design to **Other designs** or assign it as a card type default or variant. **Current Designs → Shared footer → Character cards → Edit Character footer** lets you place and size Card number, Set Abbrev, Set Symbol, and Footer divider. **Save Character default** applies to new and linked Characters. **Use on saved Character cards** links existing Characters. **All card types** opens the project-wide layout.

**Customize footer here** in Layout Designer copies the visible shared footer for one card. **Auto contrast** adapts to the area behind footer text and monochrome marks. In **Card View → Select cards**, choose cards and **Apply type defaults** to update their layouts, colors, and symbols. Card content, artwork, and foil stay with each card. The last batch has an undo action while the project is open.

On a phone, the **Tool** menu opens any workspace. Card Designer opens new cards with the keyboard closed. The preview keeps more room while you type on a short screen. In Layout Designer, **Footer** opens the collection layers alongside the live card. Zoom keeps the selected layer in view for close editing.

The standard MNC back stacks Movie, Night, and Club above Trading, Card, and Game. Open **Back Designer → Edit a copy of the MNC back** to make a variant.

In Foil Lab, choose **Foil pattern → Fractals → Kaleidoscope folds** and adjust its geometry in **Pattern settings**. Use **Load finish** for built-in and saved finishes and **Save finish** to name your own.

## Publish from your GitHub account

1. Extract this archive. Use the `mnc-creative-suite/` folder as the root of a new repository named `mnc-creative-suite`. Keep the included `.nojekyll` file in that root.
2. Push the files to `main`. GitHub Pro supports Pages from a private personal repository. GitHub Free supports Pages from a public repository. The published website on a personal account is public in either case. [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) · [Publishing and visibility](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
3. In that repository, open **Settings → Pages**. Choose **Deploy from a branch**, then **main** and **/(root)**. Save and wait for the deployment. Use the page link shown in that setting.
4. Open the link in a private browser window. Try **Open Creative Suite**, then send the link to your friend.

### Push from WSL with GitHub CLI

For a **new private repo** on a Pages-eligible account, run this from the extracted folder after authenticating `gh` in WSL.

```bash
git init -b main
git add .
git commit -m "Publish MNC Creative Suite browser edition"
gh repo create flarnrules/mnc-creative-suite --private --source=. --remote=origin --push
```

For a GitHub Free public demo, choose `--public` in the last command. It makes the demo repository and its included files visible. Keep personal workbooks, artwork, and project backups in your separate private workspace.

If you use the suggested repository name, the Pages address is [flarnrules.github.io/mnc-creative-suite/](https://flarnrules.github.io/mnc-creative-suite/) after publishing.

## Release local and web together

Use the same direct local release ZIP for both editions. Put the ZIP in the local project’s `updates/` folder and run the launcher from the project folder. The ZIP has `mnc-release.json` at its root.

From this web checkout, pass the tested ZIP to the release script.

```bash
mnc_release="$HOME/repos/frogs/collections/47-mnc-tcg/updates/MNC_Creative_Suite_v0_9_23_Release.zip"
python3 tools/stage_web_release.py "$mnc_release"
python3 tools/stage_web_release.py "$mnc_release" --check
git diff --stat
```

The script stages the shared studio code in the working tree. The web edition uses its own browser storage and demo assets. Commit the resulting changes and merge them into the branch that GitHub Pages publishes. Review the shared file list in the script when adding a new studio module.

## Link an existing Item

In **Card Designer**, set **Role / family** to **Item**. Choose **Meme items** (or the appropriate group) under **Item set group**, then click **Open set slots**. Choose the card in **Linked design** on the row you want.

## Make and share a card

1. In **Artwork**, import or choose an image and click **New card with this art**.
2. In **Current Designs**, choose a card type for its colors, glyph, border, and layout. Finish the title and details in **Card Designer**.
3. Card edits save in this browser. **Current Designs → Starting design** opens a separate editor for the design new cards use. Use **Saved cards** to reopen a design, **New card** to start fresh, or **Duplicate card** to copy the current design. Named layouts live under **Reusable layouts**. **Current Designs → Shared footer** controls the collection code, mark, and number for participating cards.
4. Use **Export PNG** for an image. To share editable cards and their artwork, send the file from **Project & Backup → Export project JSON**. Import the JSON into a separate review project so it can be opened alongside your main collection.

## Run a local preview

From this folder, run `python3 -m http.server 8000 --bind 127.0.0.1` and open [localhost:8000](http://localhost:8000/).
